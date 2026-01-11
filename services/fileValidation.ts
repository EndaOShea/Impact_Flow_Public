/**
 * File validation utilities for attachments
 * Frontend-side validation (defense in depth with backend validation)
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const MAX_ATTACHMENTS = 3;

// Whitelist of allowed file types (security measure)
const ALLOWED_TYPES = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    // Images (safe formats only)
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
];

// Whitelist of allowed file extensions
const ALLOWED_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp'
];

/**
 * Validate a single file
 */
export const validateFile = (file: { name: string; type: string; url: string; size: number }) => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File "${file.name}" exceeds maximum size of 5MB`
        };
    }

    // Check MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `File type "${file.type}" is not allowed. Allowed types: PDF, Word, Excel, PowerPoint, Text, CSV, Images (JPG/PNG/GIF/WEBP)`
        };
    }

    // Check file extension (defense in depth)
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext =>
        file.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExtension) {
        return {
            valid: false,
            error: `File extension for "${file.name}" is not allowed`
        };
    }

    // Sanitize filename (remove path traversal attempts)
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    return {
        valid: true,
        sanitizedName
    };
};

/**
 * Validate attachment count
 */
export const validateAttachmentCount = (currentCount: number, newCount: number) => {
    if (currentCount + newCount > MAX_ATTACHMENTS) {
        return {
            valid: false,
            error: `Maximum ${MAX_ATTACHMENTS} attachments allowed. Current: ${currentCount}`
        };
    }
    return { valid: true };
};
