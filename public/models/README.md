# SelfieSegmenter model

`selfie_segmenter.tflite` is the official MediaPipe SelfieSegmenter square
model used by the in-browser person cutout feature.

- Official model documentation: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter#selfie_segmentation_model
- Official model download: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
- Input shape: 256 × 256, float16
- Output: background/person segmentation confidence

The model and MediaPipe WASM files are served from this project so uploaded
images can be processed locally in the user's browser.
