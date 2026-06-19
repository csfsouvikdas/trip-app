"use client";

import * as React from "react";
import { useDashboard } from "@/components/providers";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Image, Upload, Trash2, ExternalLink, Calendar, User, Loader2, RefreshCw, AlertCircle, Info, Sparkles } from "lucide-react";
import Link from "next/link";

interface TripPhoto {
  id: string;
  trip_id: string;
  url: string;
  name: string;
  uploaded_by: string;
  created_at: string;
}

const isVideoFile = (url: string, name: string) => {
  const extension = name.split('.').pop()?.toLowerCase();
  return ["mp4", "mov", "webm", "avi", "mkv", "3gp", "wmv"].includes(extension || "") || url.toLowerCase().includes("video");
};

export default function GalleryPage() {
  const { activeTrip, profile } = useDashboard();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = React.useState<TripPhoto | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [isSandbox, setIsSandbox] = React.useState<boolean | null>(null);

  // Fetch photos for this trip
  const { data: photos = [], isLoading, refetch } = useQuery<TripPhoto[]>({
    queryKey: ["trip_photos", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [];
      const { data, error } = await supabase
        .from("trip_photos")
        .select("*")
        .eq("trip_id", activeTrip.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!activeTrip?.id,
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!activeTrip || !profile) return;
    
    const validFiles = files.filter(file => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (validFiles.length === 0) {
      setUploadError("Only image and video files are supported.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    let succeeded = 0;
    let failed = 0;
    let lastError = "";

    for (const file of validFiles) {
      try {
        const queryParams = new URLSearchParams({
          filename: file.name,
          mimeType: file.type,
          tripId: activeTrip.id,
        });

        const res = await fetch(`/api/drive/upload?${queryParams.toString()}`, {
          method: "POST",
          body: file, // Send raw binary file to bypass Next.js FormData parsing size limits
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to upload file");
        }

        const uploadData = await res.json();
        setIsSandbox(uploadData.isSandbox);

        // Insert media reference into Supabase database
        const { error: dbErr } = await supabase.from("trip_photos").insert({
          trip_id: activeTrip.id,
          url: uploadData.url,
          name: uploadData.name,
          uploaded_by: profile.username || "unknown",
        });

        if (dbErr) throw dbErr;
        succeeded++;
      } catch (err: any) {
        console.error(`Upload error for ${file.name}:`, err);
        failed++;
        lastError = err.message || "Failed to upload some files.";
      }
    }

    queryClient.invalidateQueries({ queryKey: ["trip_photos", activeTrip.id] });

    if (failed > 0) {
      setUploadError(`Uploaded ${succeeded} files successfully. Failed ${failed} files. Error: ${lastError}`);
    } else {
      setUploadError(null);
    }
    setUploading(false);
  };

  const handleDeletePhoto = async (e: React.MouseEvent, photoId: string) => {
    e.stopPropagation(); // Avoid opening lightbox
    if (!profile?.is_admin) {
      alert("Only administrators are permitted to delete photo entries.");
      return;
    }

    if (!confirm("Are you sure you want to delete this photo reference from the gang list?")) return;

    try {
      const { error } = await supabase.from("trip_photos").delete().eq("id", photoId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["trip_photos", activeTrip?.id] });
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete photo");
    }
  };

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
          <Image className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No Active Trip Workspace</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          You must activate a trip workspace before uploading photo logs or accessing the gang gallery.
        </p>
        <Link href="/dashboard/trips" className="mt-5">
          <Button variant="default" className="cursor-pointer">
            Go to Trips
          </Button>
        </Link>
      </div>
    );
  }

  const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1ZMYxjoC7NH8CFnxyD4EQZ7Pw2KXY6yMU?usp=sharing";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Image className="h-6 w-6 text-neutral-800 dark:text-neutral-200" />
            Gang Trip Gallery
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Capture, upload, and sync photo memories directly into our shared Google Drive workspace.
          </p>
        </div>

        {/* View Shared Google Drive Link */}
        <Link href={DRIVE_FOLDER_URL} target="_blank" rel="noreferrer" className="self-start sm:self-auto">
          <Button className="cursor-pointer text-xs font-bold gap-1.5" variant="accent">
            <ExternalLink className="h-3.5 w-3.5" />
            View Google Drive Folder
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Drag & Drop upload area */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border border-neutral-100 dark:border-neutral-800/80 sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Upload Media</CardTitle>
              <CardDescription>Drag and drop snapshots here to sync them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-xs flex gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Drag/Drop area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-apple flex flex-col items-center justify-center min-h-[180px] relative ${
                  dragActive
                    ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5"
                    : "border-neutral-200 dark:border-neutral-850 bg-white/40 dark:bg-neutral-900/30 hover:border-neutral-300 dark:hover:border-neutral-700"
                }`}
              >
                {uploading ? (
                  <div className="space-y-2.5">
                    <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))] mx-auto" />
                    <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Uploading to workspace...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="h-10 w-10 rounded-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 flex items-center justify-center mx-auto text-neutral-400 group-hover:text-neutral-600">
                      <Upload className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="text-xs font-medium text-neutral-500">
                      <label className="text-[hsl(var(--accent))] hover:underline cursor-pointer font-bold block mb-1">
                        Choose files
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>
                      or drag & drop here
                    </div>
                    <p className="text-[9px] text-neutral-400">Supports photos & videos of any size</p>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="p-3 bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-850 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Sync Status
                  </span>
                </div>
                {isSandbox === true ? (
                  <p className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-450 leading-relaxed">
                    💡 <strong>Sandbox Mode:</strong> Photos are saved locally. Connect your Google Cloud service account keys in `.env.local` to enable direct Google Drive sync.
                  </p>
                ) : isSandbox === false ? (
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-500 leading-relaxed">
                    💚 <strong>Sync Active:</strong> Photos are uploaded and hosted directly in the gang's Google Drive folder.
                  </p>
                ) : (
                  <p className="text-[11px] text-neutral-450 leading-relaxed">
                    Will verify Google credentials during upload sync.
                  </p>
                )}
              </div>

              {/* Google Drive Connection */}
              <div className="p-3 bg-neutral-50/50 dark:bg-neutral-950/20 border border-neutral-100 dark:border-neutral-850 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Google Drive Link
                  </span>
                </div>
                {activeTrip.google_refresh_token ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-500 leading-relaxed flex items-center gap-1">
                      💚 Connected to Google Drive
                    </p>
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      Uploads will use your authenticated user credentials and personal storage quota.
                    </p>
                    <Link href={`/api/drive/auth/init?tripId=${activeTrip.id}`}>
                      <Button size="sm" variant="outline" className="w-full text-[10px] h-7 font-bold cursor-pointer">
                        Reconnect Account
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-555 leading-relaxed">
                      ⚠️ Personal Drive Disconnected
                    </p>
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      Authenticate with your Google Account so uploads go to your drive folder directly.
                    </p>
                    <Link href={`/api/drive/auth/init?tripId=${activeTrip.id}`}>
                      <Button size="sm" className="w-full text-[10px] h-7 font-bold gap-1 cursor-pointer" variant="default">
                        Connect Google Account
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Grid and List of Photos */}
        <div className="lg:col-span-3 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl bg-white dark:bg-neutral-900/30 text-center">
              <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
                <Image className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50">Empty Gang Gallery</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 max-w-sm">
                No trip memories have been uploaded. Upload a photo on the left dropzone to kickstart the gang logs.
              </p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 md:columns-3 gap-5 space-y-5">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="break-inside-avoid bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-850 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-apple cursor-zoom-in group relative"
                >
                  {isVideoFile(photo.url, photo.name) ? (
                    <div className="w-full relative aspect-video max-h-[360px] bg-black flex items-center justify-center overflow-hidden">
                      <video
                        src={photo.url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/15 transition-colors duration-250">
                        <div className="h-9 w-9 rounded-full bg-white/20 hover:bg-white/45 backdrop-blur-md flex items-center justify-center text-white transition-apple text-xs">
                          ▶
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full object-cover max-h-[360px] h-auto transition-transform duration-300 group-hover:scale-101"
                      loading="lazy"
                    />
                  )}

                  {/* Info Overlay on Hover */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between gap-3">
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="text-xs font-bold truncate">{photo.name}</p>
                      <p className="text-[10px] opacity-80 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        by @{photo.uploaded_by}
                      </p>
                    </div>

                    {profile?.is_admin && (
                      <button
                        onClick={(e) => handleDeletePhoto(e, photo.id)}
                        className="p-1.5 bg-red-500/20 hover:bg-red-500/80 rounded-md text-red-200 hover:text-white transition-apple cursor-pointer shrink-0"
                        title="Delete photo log"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox / Enlarged View Dialog Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col justify-between p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          {/* Close button top right */}
          <div className="flex justify-end p-2 w-full shrink-0">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="text-white hover:text-neutral-350 p-2 text-sm font-bold bg-white/10 rounded-full cursor-pointer h-9 w-9 flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          {/* High Res Picture Container */}
          <div className="flex-1 flex items-center justify-center overflow-hidden max-w-5xl mx-auto py-4 w-full">
            {isVideoFile(selectedPhoto.url, selectedPhoto.name) ? (
              <video
                src={selectedPhoto.url}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          {/* Image Info Footer panel */}
          <div
            className="w-full max-w-xl mx-auto bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-white text-xs shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="font-bold text-sm text-neutral-50">{selectedPhoto.name}</h4>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[10px] text-neutral-400">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Uploaded by @{selectedPhoto.uploaded_by}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(selectedPhoto.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={selectedPhoto.url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" className="h-8 text-[10px] font-bold gap-1 cursor-pointer">
                  <ExternalLink className="h-3 w-3" />
                  View Original
                </Button>
              </Link>
              {profile?.is_admin && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-[10px] font-bold gap-1 cursor-pointer"
                  onClick={(e) => handleDeletePhoto(e, selectedPhoto.id)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Entry
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
