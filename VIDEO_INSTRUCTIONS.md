# Background Video Implementation

The Extension Forge application now features a dynamic forging-themed background video.

## Current Implementation

The application is currently using the following video file as a background:
- `src/assets/TNT - José Aldo on Vimeo (online-video-cutter.com).mp4`

This video is directly imported in the BackgroundVideo component and plays automatically in a loop in the background of the homepage.

## Changing the Background Video

If you want to replace the current video with a different forging/blacksmithing video:

1. **Prepare your new video**:
   - Format: MP4 with H.264 codec (most compatible)
   - Resolution: 1280×720 (720p) or 1920×1080 (1080p) recommended
   - Duration: 10-30 seconds is ideal (it will loop automatically)

2. **Add your new video**:
   - Place your video file in the `src/assets/` folder
   - Update the import in `src/components/BackgroundVideo.js` to reference your new video file

## Video Requirements

For best performance:
- Resolution: 1280×720 (720p) or 1920×1080 (1080p)
- Duration: 10-30 seconds (it will loop automatically)
- Format: MP4 with H.264 codec
- Size: Keep under 5MB if possible for better performance

The video will be displayed with `object-fit: cover` so it will fill the entire screen while maintaining its aspect ratio.

## Troubleshooting

If your video doesn't appear:
1. Make sure the path is correct: `src/assets/forging-video.mp4`
2. Check that the video format is supported by all browsers (MP4 with H.264 is most compatible)
3. Try a different video file if issues persist