type WorkerResponse = {
  id: number
  blob?: Blob
  error?: string
}

type PendingRequest = {
  resolve: (blob: Blob) => void
  reject: (error: Error) => void
  timer: number
}

const MAX_CUTOUT_EDGE = 2048
const REQUEST_TIMEOUT_MS = 90_000
let nextRequestId = 1
let worker: Worker | null = null
const pendingRequests = new Map<number, PendingRequest>()

function rejectAll(message: string) {
  for (const request of pendingRequests.values()) {
    window.clearTimeout(request.timer)
    request.reject(new Error(message))
  }
  pendingRequests.clear()
}

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./personSegmenter.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', ({ data }: MessageEvent<WorkerResponse>) => {
    const request = pendingRequests.get(data.id)
    if (!request) return
    pendingRequests.delete(data.id)
    window.clearTimeout(request.timer)
    if (data.blob) request.resolve(data.blob)
    else request.reject(new Error(data.error || 'AI 抠图失败'))
  })
  worker.addEventListener('error', () => {
    rejectAll('AI 抠图模块加载失败，请刷新后重试')
    worker?.terminate()
    worker = null
  })
  return worker
}

function resizedDimensions(image: HTMLImageElement) {
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight)
  const scale = longestEdge > MAX_CUTOUT_EDGE ? MAX_CUTOUT_EDGE / longestEdge : 1
  return {
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale)),
  }
}

export async function cutOutPerson(image: HTMLImageElement, threshold = 0.5) {
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('原图尚未读取完成')
  const dimensions = resizedDimensions(image)
  const bitmap = await createImageBitmap(image, {
    resizeWidth: dimensions.width,
    resizeHeight: dimensions.height,
    resizeQuality: 'high',
  })
  const id = nextRequestId++
  const assetBase = new URL(import.meta.env.BASE_URL, window.location.href).href

  return new Promise<Blob>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error('AI 抠图超时，请换一张尺寸较小的图片重试'))
    }, REQUEST_TIMEOUT_MS)
    pendingRequests.set(id, { resolve, reject, timer })
    try {
      getWorker().postMessage({ id, image: bitmap, assetBase, threshold }, [bitmap])
    } catch (error) {
      pendingRequests.delete(id)
      window.clearTimeout(timer)
      bitmap.close()
      reject(error instanceof Error ? error : new Error('无法启动 AI 抠图'))
    }
  })
}
