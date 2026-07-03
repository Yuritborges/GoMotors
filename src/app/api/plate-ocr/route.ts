import { NextResponse } from "next/server";
import { handleAuthError, requireAuth } from "@/lib/auth";
import { recognizePlateOnServer } from "@/lib/plate-ocr-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json(
        { error: "Envie uma foto da placa." },
        { status: 400 }
      );
    }

    if (image.size === 0) {
      return NextResponse.json(
        { error: "A foto está vazia. Tente escolher outra imagem." },
        { status: 400 }
      );
    }

    if (image.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Foto muito grande. Use uma imagem menor que 8 MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const plate = await recognizePlateOnServer(buffer);

    if (!plate) {
      return NextResponse.json({
        plate: null,
        error:
          "Não encontramos a placa na foto. Enquadre só a placa ou digite manualmente.",
      });
    }

    return NextResponse.json({ plate });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[plate-ocr]", error);
      return NextResponse.json(
        {
          error:
            "Erro ao processar a foto. Tente outra imagem ou digite a placa.",
        },
        { status: 500 }
      );
    }
  }
}
