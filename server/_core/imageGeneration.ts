/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env.js";
import { getNvidiaApiKey } from "./aiKeys.js";
import { cloudinaryConfigured } from "../services.js";

/**
 * Generates photorealistic 16:9 PNG images using NVIDIA NIM (FLUX.1-schnell).
 * Automatically uploads the resulting PNG to Cloudinary CDN if configured.
 */
export async function generateNvidiaFluxImage(prompt: string): Promise<string | null> {
  const nvidiaKey = getNvidiaApiKey();
  if (!nvidiaKey || !prompt) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const endpoints = [
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell",
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-schnell",
      "https://integrate.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell",
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          signal: controller.signal,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${nvidiaKey}`,
          },
          body: JSON.stringify({
            prompt: `${prompt}. High-quality editorial technology photography, 16:9 aspect ratio, 4k resolution, sharp focus, professional studio lighting, realistic, no text, no watermark.`,
            mode: "base64",
          }),
        });

        if (response.ok) {
          clearTimeout(timeout);
          const data = await response.json();
          const b64 = data.b64_json || data.artifacts?.[0]?.base64 || data.image || data.predictions?.[0]?.bytesBase64Encoded;
          if (b64) {
            const dataUri = `data:image/png;base64,${b64}`;
            if (cloudinaryConfigured()) {
              try {
                const { v2: cloudinary } = await import("cloudinary");
                cloudinary.config({
                  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                  api_key: process.env.CLOUDINARY_API_KEY,
                  api_secret: process.env.CLOUDINARY_API_SECRET,
                });
                const uploadRes = await cloudinary.uploader.upload(dataUri, {
                  folder: "aurikrex/posts",
                  resource_type: "image",
                });
                if (uploadRes.secure_url || uploadRes.url) {
                  return uploadRes.secure_url || uploadRes.url;
                }
              } catch {
                // Cloudinary fallback to dataUri
              }
            }
            return dataUri;
          }
        }
      } catch {
        // Try next endpoint
      }
    }
    clearTimeout(timeout);
  } catch (err) {
    console.warn("[NVIDIA FLUX] Generation failed:", err instanceof Error ? err.message : String(err));
  }

  return null;
}

export function getTopicStockImage(headline: string, category = "Tech"): string {
  const h = headline.toLowerCase();
  if (/ai|model|llm|deepseek|chatgpt|openai|claude|numbat|robot|agent|neural/.test(h)) {
    return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80";
  }
  if (/chip|hardware|semiconductor|huawei|apple|nvidia|intel|processor|camera|phone/.test(h)) {
    return "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80";
  }
  if (/space|satellite|orbit|moon|rocket|astronomy|starlink|earth/.test(h)) {
    return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80";
  }
  if (/car|tesla|ev|vehicle|battery|autonomous|transport/.test(h)) {
    return "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80";
  }
  if (/crypto|bitcoin|ethereum|blockchain|token/.test(h)) {
    return "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80";
  }
  if (/science|health|dna|drug|biology|physics|cell/.test(h)) {
    return "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80";
  }
  return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80";
}

// Default model for generated sites. "MODEL_GPT_IMAGE_2" is the forge images.v1
// enum for GPT Image 2 (id: gpt-image-2). If omitted, forge falls back to Gemini 2.5 Flash.
const DEFAULT_IMAGE_MODEL = "MODEL_GPT_IMAGE_2";
const DEFAULT_IMAGE_QUALITY = "medium";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** Forge image model enum, e.g. "MODEL_GPT_IMAGE_2". Defaults to GPT Image 2. */
  model?: string;
  /** Generation quality, e.g. "medium" | "high". Defaults to "medium" for GPT Image 2. */
  quality?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const quality =
    options.quality ?? (model === DEFAULT_IMAGE_MODEL ? DEFAULT_IMAGE_QUALITY : undefined);

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
      model,
      ...(quality ? { quality } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    image: {
      b64Json: string;
      mimeType: string;
    };
  };
  const base64Data = result.image.b64Json;
  const buffer = Buffer.from(base64Data, "base64");

  // Save to S3
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    result.image.mimeType
  );
  return {
    url,
  };
}

export type ImageModelInfo = {
  /** Forge model enum, e.g. "MODEL_GPT_IMAGE_2". Pass into generateImage({ model }). */
  model?: string;
  /** Stable model id, e.g. "gpt-image-2". */
  id?: string;
};

export type ListImageModelsResponse = {
  models: ImageModelInfo[];
};

/**
 * List the image models the internal ImageService currently supports.
 * Feed a returned `model` value into generateImage({ model }).
 */
export async function listImageModels(): Promise<ListImageModelsResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/ListModels",
    baseUrl
  ).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: "{}",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `List image models failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as { models?: ImageModelInfo[] };
  return { models: result.models ?? [] };
}
