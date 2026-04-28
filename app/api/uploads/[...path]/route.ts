import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkImageOwnership, readStoredImage } from "@/lib/storage";

// GET /api/uploads/{userId}/{templateId}/{filename}
//
// Serves a file from the local uploads directory. Two guards:
//   1. session must exist (otherwise 401)
//   2. the path's first segment must match the session's user id
//      (otherwise 403) — this prevents one user from reading another
//      user's images by guessing paths.
//
// We don't expose a list endpoint; clients only know paths returned
// by uploadImageAction, which always start with the uploader's id.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const relativePath = path.join("/");

  if (
    !checkImageOwnership({ userId: session.user.id, relativePath })
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const file = await readStoredImage(relativePath);
  if (!file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(file.buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      // Files are content-addressable via their random stem prefix —
      // safe to cache aggressively. Browser will refetch when the
      // widget config points to a different file.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
