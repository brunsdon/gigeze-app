import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { deleteJourney, updateJourney } from "@/features/tours/service";
import { journeyUpdateSchema } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils/app-error";

function serializeJourney(Tour: {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  status: unknown;
  visibility: unknown;
  coverImageUrl: string | null;
}) {
  return {
    id: Tour.id,
    title: Tour.title,
    description: Tour.description,
    startDate: Tour.startDate.toISOString(),
    endDate: Tour.endDate?.toISOString() ?? null,
    status: Tour.status,
    visibility: Tour.visibility,
    coverImageUrl: Tour.coverImageUrl,
  };
}

function revalidateJourneySurfaces(journeyId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tours");
  revalidatePath("/tours");

  if (journeyId) {
    revalidatePath(`/dashboard/tours/${journeyId}`);
    revalidatePath(`/dashboard/tours/${journeyId}/edit`);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tourId: string }> },
) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tourId: journeyId } = await params;
  if (!journeyId) {
    return NextResponse.json({ error: "invalid-Tour-reference" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = journeyUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Tour-invalid-input" }, { status: 400 });
  }

  try {
    const Tour = await updateJourney(journeyId, parsed.data, { workspaceId: authContext.workspace.id });

    revalidateJourneySurfaces(Tour.id);

    return NextResponse.json({ Tour: serializeJourney(Tour) });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tourId: string }> },
) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tourId: journeyId } = await params;
  if (!journeyId) {
    return NextResponse.json({ error: "invalid-Tour-reference" }, { status: 400 });
  }

  try {
    const Tour = await deleteJourney(journeyId, authContext.workspace.id);

    revalidateJourneySurfaces(Tour.id);

    return NextResponse.json({ journeyId: Tour.id, deleted: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
