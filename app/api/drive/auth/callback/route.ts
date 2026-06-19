import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const tripId = searchParams.get("state"); // The state parameter contains the tripId

    if (!code || !tripId) {
      return NextResponse.json({ error: "Missing authorization code or trip ID" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth credentials are not configured in environment variables." },
        { status: 500 }
      );
    }

    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/api/drive/auth/callback`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const refresh_token = tokens.refresh_token;

    // Connect to Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase URL or Key is missing in environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const updateData: { google_refresh_token?: string; google_folder_id?: string } = {};
    if (refresh_token) {
      updateData.google_refresh_token = refresh_token;
    }
    
    // Set default folder ID if present
    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      updateData.google_folder_id = process.env.GOOGLE_DRIVE_FOLDER_ID;
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from("trips")
        .update(updateData)
        .eq("id", tripId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    }

    // Redirect the user back to the gallery page
    const redirectUrl = new URL("/dashboard/gallery", req.url);
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return NextResponse.json({ error: err.message || "Failed to complete authentication" }, { status: 500 });
  }
}
