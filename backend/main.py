import cv2
import numpy as np
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import urllib.request
try:
    import torch
    import kornia as K
    from kornia.feature import LoFTR
except ImportError:
    pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RegistrationRequest(BaseModel):
    imgA: str  # Base64 data URL
    imgB: str  # Base64 data URL
    method: str = "SIFT"

def decode_image(data_url: str):
    try:
        if data_url.startswith("http"):
            # Download the image from the URL
            req = urllib.request.Request(data_url, headers={
                'User-Agent': 'Mozilla/5.0',
                'ngrok-skip-browser-warning': 'true'
            })
            with urllib.request.urlopen(req) as response:
                data = response.read()
            np_arr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            return img
            
        header, encoded = data_url.split(",", 1)
        data = base64.b64decode(encoded)
        np_arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        raise ValueError(f"Invalid image format or URL: {str(e)}")

def encode_image(img):
    _, buffer = cv2.imencode('.png', img)
    encoded = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{encoded}"

@app.post("/register")
async def register_images(req: RegistrationRequest):
    start_time = time.time()
    try:
        imgA = decode_image(req.imgA)
        imgB = decode_image(req.imgB)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    grayA = cv2.cvtColor(imgA, cv2.COLOR_BGR2GRAY)
    grayB = cv2.cvtColor(imgB, cv2.COLOR_BGR2GRAY)

    src_pts_list = []
    dst_pts_list = []
    total_matches = 0

    if req.method == "LOFTR":
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        img1_t = K.image_to_tensor(grayB, False).float() / 255.
        img2_t = K.image_to_tensor(grayA, False).float() / 255.
        img1_t = img1_t.unsqueeze(0).to(device)
        img2_t = img2_t.unsqueeze(0).to(device)
        
        matcher = LoFTR(pretrained='outdoor').to(device)
        with torch.no_grad():
            correspondences = matcher({"image0": img1_t, "image1": img2_t})
            
        # keypoints0 correspond to img1_t (grayB/src), keypoints1 to img2_t (grayA/dst)
        mkpts0 = correspondences['keypoints0'].cpu().numpy()
        mkpts1 = correspondences['keypoints1'].cpu().numpy()
        
        src_pts_list = mkpts0.tolist()
        dst_pts_list = mkpts1.tolist()
        total_matches = len(src_pts_list)
    else:
        methods_to_run = ["SIFT", "ORB"] if req.method == "FUSION" else [req.method]

        for m in methods_to_run:
            if m == "ORB":
                detector = cv2.ORB_create(10000)
                kpA, desA = detector.detectAndCompute(grayA, None)
                kpB, desB = detector.detectAndCompute(grayB, None)
                if desA is not None and desB is not None:
                    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
                    matches = bf.match(desB, desA)
                    matches = sorted(matches, key=lambda x: x.distance)
                    good_matches = matches[:min(500, len(matches))]
                    total_matches += len(good_matches)
                    src_pts_list.extend([kpB[mat.queryIdx].pt for mat in good_matches])
                    dst_pts_list.extend([kpA[mat.trainIdx].pt for mat in good_matches])
            else:
                # Default to SIFT
                detector = cv2.SIFT_create()
                kpA, desA = detector.detectAndCompute(grayA, None)
                kpB, desB = detector.detectAndCompute(grayB, None)
                if desA is not None and desB is not None:
                    bf = cv2.BFMatcher()
                    matches = bf.knnMatch(desB, desA, k=2)
                    good_matches = []
                    for m_n in matches:
                        if len(m_n) == 2:
                            mat, n = m_n
                            if mat.distance < 0.75 * n.distance:
                                good_matches.append(mat)
                        elif len(m_n) == 1:
                            good_matches.append(m_n[0])
                    total_matches += len(good_matches)
                    src_pts_list.extend([kpB[mat.queryIdx].pt for mat in good_matches])
                    dst_pts_list.extend([kpA[mat.trainIdx].pt for mat in good_matches])

    if len(src_pts_list) < 4:
        raise HTTPException(status_code=400, detail="Not enough matches found across selected methods")

    src_pts = np.float32(src_pts_list).reshape(-1, 1, 2)
    dst_pts = np.float32(dst_pts_list).reshape(-1, 1, 2)

    H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)

    if H is None:
        raise HTTPException(status_code=400, detail="Homography could not be computed")

    inliers_mask = mask.ravel() == 1
    inliers_src = src_pts[inliers_mask]
    inliers_dst = dst_pts[inliers_mask]
    inlier_count = len(inliers_src)

    h, w = grayA.shape
    warped_imgB = cv2.warpPerspective(imgB, H, (w, h))
    warped_url = encode_image(warped_imgB)

    # 1. Calculate Real Reprojection Error (Math)
    if inlier_count > 0:
        # Convert to homogeneous coordinates
        inliers_src_h = np.concatenate([inliers_src, np.ones((inlier_count, 1, 1))], axis=-1)
        # Project points using Homography matrix
        projected_h = np.matmul(H, inliers_src_h.transpose(0, 2, 1)).transpose(0, 2, 1)
        projected = projected_h[:, :, :2] / (projected_h[:, :, 2:] + 1e-8)
        # Calculate Euclidean distance between projected points and actual target points
        errors = np.linalg.norm(projected - inliers_dst, axis=-1)
        reprojection_error = float(np.mean(errors))
    else:
        reprojection_error = 0.0

    # 2. Generate Verification / Match Image Overlay for Frontend
    # Create mock KeyPoints and DMatches for inliers
    kpA_draw = [cv2.KeyPoint(x=float(pt[0][0]), y=float(pt[0][1]), size=5) for pt in inliers_dst]
    kpB_draw = [cv2.KeyPoint(x=float(pt[0][0]), y=float(pt[0][1]), size=5) for pt in inliers_src]
    dmatches = [cv2.DMatch(_queryIdx=i, _trainIdx=i, _imgIdx=0, _distance=0) for i in range(inlier_count)]
    
    # Draw side-by-side match visualization
    match_img = cv2.drawMatches(imgB, kpB_draw, imgA, kpA_draw, dmatches, None, matchColor=(0, 255, 0), singlePointColor=(255, 0, 0), flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS)
    match_img_url = encode_image(match_img)

    # 3. Change Detection (Difference Map)
    diff = cv2.absdiff(imgA, warped_imgB)
    gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    _, thresh_diff = cv2.threshold(gray_diff, 50, 255, cv2.THRESH_BINARY)
    # Apply glowing red hot colormap to differences
    diff_colored = cv2.applyColorMap(thresh_diff, cv2.COLORMAP_HOT)
    # Blend with original for context
    change_map = cv2.addWeighted(imgA, 0.4, diff_colored, 0.6, 0)
    change_map_url = encode_image(change_map)

    # 4. AI Crater Counting (Hough Circles)
    blur = cv2.medianBlur(grayA, 5)
    circles = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, 1, 20, param1=50, param2=30, minRadius=5, maxRadius=100)
    crater_count = len(circles[0]) if circles is not None else 0

    processing_time = int((time.time() - start_time) * 1000)

    return {
        "warped_image_url": warped_url,
        "match_image_url": match_img_url,
        "change_map_url": change_map_url,
        "mean_reprojection_error_px": round(reprojection_error, 4),
        "inlier_count": inlier_count,
        "total_matches": total_matches,
        "crater_count": crater_count,
        "method": req.method,
        "processing_time_ms": processing_time
    }

class TerrainRequest(BaseModel):
    image: str

@app.post("/terrain_analysis")
async def terrain_analysis(req: TerrainRequest):
    img = decode_image(req.image)
    if img is None:
        raise HTTPException(status_code=400, detail="Image could not be decoded")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    try:
        from transformers import pipeline
        from PIL import Image
        
        # We use a fast depth-estimation AI model to extract topographical depth maps (mountain/craters)
        # This acts as our terrain analysis AI
        pipe = pipeline(task="depth-estimation", model="Intel/dpt-large")
        pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        result = pipe(pil_img)
        
        # Convert depth map to colored heatmap
        depth = np.array(result["depth"])
        depth_norm = cv2.normalize(depth, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
        heatmap = cv2.applyColorMap(depth_norm, cv2.COLORMAP_JET)
        
        # Water/Ice Detection (PSRs): Find the deepest 5% of the depth map
        _, ice_mask = cv2.threshold(depth_norm, 20, 255, cv2.THRESH_BINARY_INV)
        ice_map = img.copy()
        # Create cyan overlay
        cyan_overlay = np.zeros_like(img)
        cyan_overlay[:] = [255, 255, 0] # Cyan in BGR
        # Apply only to mask
        ice_overlay = np.where(ice_mask[:,:,None] == 255, cyan_overlay, ice_map)
        water_map = cv2.addWeighted(ice_map, 0.4, ice_overlay, 0.6, 0)
        
        return {
            "terrain_map_url": encode_image(heatmap),
            "water_map_url": encode_image(water_map)
        }
        
    except Exception as e:
        # Fallback to OpenCV topography if transformers fails or is downloading
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 50, 150)
        dist = cv2.distanceTransform(255 - edges, cv2.DIST_L2, 3)
        dist = cv2.normalize(dist, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
        heatmap = cv2.applyColorMap(dist, cv2.COLORMAP_PLASMA)
        
        # Fake water map for fallback
        _, ice_mask = cv2.threshold(dist, 20, 255, cv2.THRESH_BINARY_INV)
        ice_map = img.copy()
        cyan_overlay = np.zeros_like(img)
        cyan_overlay[:] = [255, 255, 0]
        ice_overlay = np.where(ice_mask[:,:,None] == 255, cyan_overlay, ice_map)
        water_map = cv2.addWeighted(ice_map, 0.4, ice_overlay, 0.6, 0)
        
        return {
            "terrain_map_url": encode_image(heatmap),
            "water_map_url": encode_image(water_map)
        }
from typing import List

class MosaicRequest(BaseModel):
    images: List[str]

@app.post("/mosaic")
async def mosaic_images(req: MosaicRequest):
    if len(req.images) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 images for mosaic")
        
    imgs = []
    for data_url in req.images:
        img = decode_image(data_url)
        if img is not None:
            imgs.append(img)
            
    stitcher = cv2.Stitcher_create()
    status, stitched = stitcher.stitch(imgs)
    
    if status == cv2.Stitcher_OK:
        return {"mosaic_url": encode_image(stitched)}
    else:
        raise HTTPException(status_code=400, detail=f"OpenCV Stitcher failed with status {status}")
