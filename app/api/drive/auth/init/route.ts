import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");

    if (!tripId) {
      return NextResponse.json({ error: "Missing tripId parameter" }, { status: 400 });
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

    // Generate authorization URL
    // access_type: "offline" and prompt: "consent" are required to get a refresh_token
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive"
      ],
      state: tripId,
    });

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error("OAuth init error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
