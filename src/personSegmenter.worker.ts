import { FilesetResolver, ImageSegmenter, type ImageSegmenterResult } from '@mediapipe/tasks-vision'
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
  applyPersonMaskToRgba(
    imageData.data,
    imageData.width,
    imageData.height,
    personMask.getAsFloat32Array(),
    personMask.width,
    personMask.height,
    threshold,
    0.14,
  )
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

    segmenter.segment(canvas, (result) => {
      try {
        applySegmentationResult(result, imageData, threshold)
      } finally {
        result.close()
      }
    })

    context.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    workerContext.postMessage({ id, blob })
  } catch (error) {
    image.close()
    workerContext.postMessage({
      id,
      error: error instanceof Error ? error.message : 'AI 抠图失败',
    })
  }
})
