"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { getFileDownloadUrl } from "@/actions/contracts";

interface DownloadButtonProps {
  storagePath: string;
  fileName: string;
}

export function DownloadButton({ storagePath, fileName }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const result = await getFileDownloadUrl(storagePath);
      if (result.url) {
        const a = document.createElement("a");
        a.href = result.url;
        a.download = fileName;
        a.click();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
      title={`Download ${fileName}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
    </button>
  );
}
