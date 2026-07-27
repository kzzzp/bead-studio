import { FilesetResolver, ImageSegmenter, type ImageSegmenterResult } from '@mediapipe/tasks-vision'
import { hasUsablePersonMask, removeSimpleBackgroundFromRgba } from './cartoonCutout.ts'
import { applyPersonMaskToRgba } from './personMask.ts'

// MediaPipe Web Image Segmenter setup and model contract:
// https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js
// https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter#selfie_segmentation_model

type SegmentRequest = {
  id: number
  image: ImageBitmap
  assetBase: string
  threshold: number
}

type SegmentResponse = {
  id: number
  blob?: Blob
  mode?: 'ai-person' | 'cartoon-background'
  error?: string
}

const workerContext = globalThis as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<SegmentRequest>) => void): void
  postMessage(message: SegmentResponse): void
}

let segmenterPromise: Promise<ImageSegmenter> | null = null

function getSegmenter(assetBase: string) {
  if (!segmenterPromise) {
    segmenterPromise = FilesetResolver.forVisionTasks(`${assetBase}mediapipe/wasm`, true)
      .then((vision) => ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${assetBase}models/selfie_segmenter.tflite` },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }))
      .catch((error) => {
        segmenterPromise = null
        throw error
      })
  }
  return segmenterPromise
}

function applySegmentationResult(
  result: ImageSegmenterResult,
  imageData: ImageData,
  threshold: number,
) {
  const masks = result.confidenceMasks
  // Current SelfieSegmenter builds may expose only the foreground confidence
  // channel; two-channel builds place the person category at index 1.
  const personMask = masks?.[1] ?? masks?.[0]
  if (!personMask) throw new Error('模型没有返回人物蒙版')
  const confidence = personMask.getAsFloat32Array()
  if (!hasUsablePersonMask(confidence, threshold)) {
    const fallback = removeSimpleBackgroundFromRgba(imageData.data, imageData.width, imageData.height)
    if (!fallback.applied) {
      throw new Error('没有识别到人物；这张图的背景较复杂，请尝试“去除边缘纯色背景”或换一张图')
    }
    return 'cartoon-background' as const
  }
  applyPersonMaskToRgba(
    imageData.data,
    imageData.width,
    imageData.height,
    confidence,
    personMask.width,
    personMask.height,
    threshold,
    0.14,
  )
  return 'ai-person' as const
}

workerContext.addEventListener('message', async ({ data }) => {
  const { id, image, assetBase, threshold } = data
  try {
    const canvas = new OffscreenCanvas(image.width, image.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('当前浏览器无法创建抠图画布')
    context.drawImage(image, 0, 0)
    image.close()
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const segmenter = await getSegmenter(assetBase)

    let mode: SegmentResponse['mode']
    segmenter.segment(canvas, (result) => {
      try {
        mode = applySegmentationResult(result, imageData, threshold)
      } finally {
        result.close()
      }
    })

    context.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    workerContext.postMessage({ id, blob, mode })
  } catch (error) {
    image.close()
    workerContext.postMessage({
      id,
      error: error instanceof Error ? error.message : 'AI 抠图失败',
    })
  }
})
