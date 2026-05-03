import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { createJourney, listJourneys } from "@/features/tours/service";
import { journeyCreateSchema } from "@/lib/validation";
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

function revalidateJourneySurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tours");
  revalidatePath("/tours");
}

export async function GET(request: Request) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const Tours = await listJourneys(authContext.workspace.id);

    return NextResponse.json({
      Tours: Tours.map((Tour) => serializeJourney(Tour)),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const authContext = await getMobileBearerAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = journeyCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Tour-invalid-input" }, { status: 400 });
  }

  try {
    const Tour = await createJourney(parsed.data, {
      workspaceId: authContext.workspace.id,
      userId: authContext.user.id,
    });

    revalidateJourneySurfaces();

    return NextResponse.json({ Tour: serializeJourney(Tour) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
