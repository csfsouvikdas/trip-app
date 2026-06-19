import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    let buffer: Buffer;
    let filename: string;
    let mimeType: string;
    let tripId: string;
    let originalName: string;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      tripId = formData.get("tripId") as string;
      
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      
      buffer = Buffer.from(await file.arrayBuffer());
      originalName = file.name;
      filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      mimeType = file.type;
    } else {
      // Raw binary upload (bypasses FormData size limits)
      const { searchParams } = new URL(req.url);
      originalName = searchParams.get("filename") || "upload";
      mimeType = searchParams.get("mimeType") || "application/octet-stream";
      tripId = searchParams.get("tripId") || "";
      
      buffer = Buffer.from(await req.arrayBuffer());
      filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    }

    // Connect to Supabase to check if this trip has a linked Google Drive token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let oauthSuccess = false;
    let driveUrl = "";
    let fileId = "";

    if (supabaseUrl && supabaseAnonKey && tripId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: trip, error } = await supabase
          .from("trips")
          .select("google_refresh_token, google_folder_id")
          .eq("id", tripId)
          .maybeSingle();

        if (!error && trip && trip.google_refresh_token) {
          const clientId = process.env.GOOGLE_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
          
          if (clientId && clientSecret) {
            const origin = new URL(req.url).origin;
            const redirectUri = `${origin}/api/drive/auth/callback`;

            const oauth2Client = new google.auth.OAuth2(
              clientId,
              clientSecret,
              redirectUri
            );

            oauth2Client.setCredentials({
              refresh_token: trip.google_refresh_token,
            });

            const drive = google.drive({ version: "v3", auth: oauth2Client });
            const targetFolderId = trip.google_folder_id || process.env.GOOGLE_DRIVE_FOLDER_ID;

            if (targetFolderId) {
              const response = await drive.files.create({
                supportsAllDrives: true,
                requestBody: {
                  name: filename,
                  parents: [targetFolderId],
                },
                media: {
                  mimeType: mimeType,
                  body: require("stream").Readable.from(buffer),
                },
                fields: "id, webViewLink, webContentLink, thumbnailLink",
              });

              const uploadedFileId = response.data.id;
              if (uploadedFileId) {
                fileId = uploadedFileId;
                
                // Set permissions to reader for anyone
                await drive.permissions.create({
                  fileId: fileId,
                  supportsAllDrives: true,
                  requestBody: {
                    role: "reader",
                    type: "anyone",
                  },
                });

                driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                oauthSuccess = true;
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Google Drive OAuth upload failed, falling back:", err);
      }
    }

    if (oauthSuccess) {
      return NextResponse.json({
        url: driveUrl,
        name: originalName,
        isSandbox: false,
        fileId: fileId,
      });
    }

    // --- Fallback to Service Account mode if configured ---
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (email && key && folderId) {
      try {
        const auth = new google.auth.JWT({
          email,
          key: key.replace(/\\n/g, "\n"),
          scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]
        });

        const drive = google.drive({ version: "v3", auth });

        const response = await drive.files.create({
          supportsAllDrives: true,
          requestBody: {
            name: filename,
            parents: [folderId],
          },
          media: {
            mimeType: mimeType,
            body: require("stream").Readable.from(buffer),
          },
          fields: "id, webViewLink, webContentLink, thumbnailLink",
        });

        const uploadedFileId = response.data.id;
        if (uploadedFileId) {
          fileId = uploadedFileId;
          
          await drive.permissions.create({
            fileId: fileId,
            supportsAllDrives: true,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
          });

          const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

          return NextResponse.json({
            url: directUrl,
            name: originalName,
            isSandbox: false,
            fileId: fileId,
          });
        }
      } catch (driveErr: any) {
        console.error("Google Drive Service Account Upload failed, falling back to local Sandbox:", driveErr);
      }
    }

    // --- Fallback Sandbox Mode ---
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const relativeUrl = `/uploads/${filename}`;

    return NextResponse.json({
      url: relativeUrl,
      name: originalName,
      isSandbox: true,
    });
  } catch (err: any) {
    console.error("Upload API error:", err);
    return NextResponse.json({ error: err.message || "Failed to process upload" }, { status: 500 });
  }
}
