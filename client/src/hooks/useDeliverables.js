import { useState }    from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deliverablesApi } from '../api/endpoints/deliverables.api';
import { projectKeys }     from './useProjects';

// Encapsulates the full 3-step Cloudinary upload flow
export const useUploadDeliverable = (milestoneId, projectId) => {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (file, changeNotes = null) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get signature from server
      const sigRes    = await deliverablesApi.getSignature(milestoneId);
      const signParams = sigRes.data.data;

      // Step 2: Upload to Cloudinary
      setProgress(10);
      const cloudResult = await deliverablesApi.uploadToCloudinary(
        file,
        signParams,
        (pct) => setProgress(10 + Math.round(pct * 0.8))
      );
      setProgress(90);

      // Step 3: Register in DB
      const mimeType = cloudResult.resource_type === 'image'
        ? `image/${cloudResult.format}`
        : cloudResult.resource_type === 'video'
        ? `video/${cloudResult.format}`
        : 'application/pdf';

      await deliverablesApi.create(milestoneId, {
        filename:        file.name,
        publicId:        cloudResult.public_id,
        fileUrl:         cloudResult.secure_url,
        fileSize:        cloudResult.bytes,
        mimeType,
        changeNotes,
        isClientVisible: true,
      });

      setProgress(100);
      qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });

      return true;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
      return false;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress, error };
};