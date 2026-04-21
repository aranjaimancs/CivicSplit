import type { SplitType } from '../types'

const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY as string | undefined

export function isOcrEnabled(): boolean {
  return !!OPENAI_KEY
}

// ─── Client-side quality check ─────────────────────────────────────────────────

export type QualityIssue = 'too_small' | 'too_dark' | 'too_bright' | 'too_blurry'

export interface QualityCheckResult {
  ok: boolean
  issue?: QualityIssue
  message?: string
}

const QUALITY_MESSAGES: Record<QualityIssue, string> = {
  too_small:  'Image is too small or cropped. Move closer and retake.',
  too_dark:   'Photo is too dark. Turn on a light and try again.',
  too_bright: 'Photo is washed out. Avoid direct glare and try again.',
  too_blurry: 'Photo is too blurry. Hold steady and tap to focus before shooting.',
}

export function checkImageQuality(file: File): Promise<QualityCheckResult> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Minimum resolution — receipts need to be readable
      if (img.width < 350 || img.height < 350) {
        resolve({ ok: false, issue: 'too_small', message: QUALITY_MESSAGES.too_small })
        return
      }

      // Sample pixels at reduced size for speed
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 500 / Math.max(img.width, img.height))
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve({ ok: true }); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

      let sum = 0
      const lums: number[] = []
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        lums.push(lum)
        sum += lum
      }
      const mean = sum / lums.length
      const variance = lums.reduce((s, v) => s + (v - mean) ** 2, 0) / lums.length

      if (mean < 38)   { resolve({ ok: false, issue: 'too_dark',   message: QUALITY_MESSAGES.too_dark   }); return }
      if (mean > 242)  { resolve({ ok: false, issue: 'too_bright', message: QUALITY_MESSAGES.too_bright }); return }
      if (variance < 180) { resolve({ ok: false, issue: 'too_blurry', message: QUALITY_MESSAGES.too_blurry }); return }

      resolve({ ok: true })
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: true }) }
    img.src = url
  })
}

export interface ScannedItem {
  name: string
  price: string
  split_type: SplitType
  aiReason: string
}

export interface ScanResult {
  storeName: string
  date: string | null  // YYYY-MM-DD or null if not found
  items: ScannedItem[]
}

/**
 * Send a receipt photo to GPT-4o Vision.
 * Extracts every line item and uses AI to classify each as
 * "shared" (household) or "personal" (individual use).
 */
export async function parseReceiptImage(imageFile: File): Promise<ScanResult> {
  if (!OPENAI_KEY) {
    throw new Error('Add VITE_OPENAI_KEY to your .env.local to use receipt scanning.')
  }

  const base64 = await fileToBase64(imageFile)

  const systemPrompt = `You are analyzing a store or grocery receipt for a group of ~5 college students living together for 8 weeks.

If the image is too blurry, too dark, severely cropped, not a receipt, or otherwise unreadable, return ONLY:
{"error": "brief description of the problem"}

Otherwise:
1. Extract every individual line item (skip tax, discounts, subtotals, and the grand total)
2. Classify each item:
   - "shared" → anything the whole household uses: cleaning supplies, paper products, shared food (bread, eggs, milk, butter, condiments, cooking oil, snacks for everyone, beverages, coffee/tea)
   - "personal" → clearly for one person only: personal hygiene products, medicine, single-serving specialty items, specific dietary supplements, deodorant, shampoo, razor blades

When unsure, default to "shared".
If you can read the store name or date from the receipt, include those.

Return ONLY valid JSON (no markdown, no code fences):
{
  "store_name": "string or empty",
  "date": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "clean short item name",
      "price": 4.99,
      "split_type": "shared" | "personal",
      "reason": "2-4 word reason"
    }
  ]
}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageFile.type};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    let msg = `OpenAI error ${response.status}`
    try {
      const body = await response.json()
      msg = body?.error?.message ?? msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  const data = await response.json()
  const raw: string = data.choices?.[0]?.message?.content ?? ''

  // Strip accidental markdown fences
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  let parsed: {
    error?: string
    store_name?: string
    date?: string | null
    items: { name: string; price: number; split_type: string; reason: string }[]
  }

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Could not parse AI response. Try a clearer photo of the receipt.')
  }

  if (parsed.error) {
    throw new Error(parsed.error)
  }

  return {
    storeName: parsed.store_name ?? '',
    date: parsed.date ?? null,
    items: (parsed.items ?? []).map((item) => ({
      name: item.name,
      price: Number(item.price).toFixed(2),
      split_type: item.split_type === 'personal' ? 'personal' : 'shared',
      aiReason: item.reason ?? '',
    })),
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
