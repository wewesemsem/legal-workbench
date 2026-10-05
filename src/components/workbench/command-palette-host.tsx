"use client";

import { CommandPalette } from "@/components/workbench/command-palette";

export function CommandPaletteHost({
  matters,
  documents,
}: {
  matters: Array<{ id: string; title: string }>;
  documents: Array<{
    id: string;
    matterId: string;
    originalFilename: string;
  }>;
}) {
  return <CommandPalette matters={matters} documents={documents} />;
}
