export type AvatarContentType = 'image/jpeg' | 'image/png';

export type UploadAvatarDto = {
  contentType: AvatarContentType;
  data: Buffer;
};
