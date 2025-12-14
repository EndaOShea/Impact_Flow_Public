/**
 * File Validation Utilities
 * Server-side validation for file attachments to prevent security vulnerabilities
 */

// Maximum file size: 5MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Maximum attachments per task
export const MAX_ATTACHMENTS_PER_TASK = 3;

// Whitelist of allowed MIME types (excludes executables, scripts, and potentially dangerous files)
export const ALLOWED_MIME_TYPES = [
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
    // Images (safe formats only - SVG excluded for XSS protection)
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
];

// Whitelist of allowed file extensions (defense in depth)
export const ALLOWED_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp'
];

/**
 * Validates a file attachment
 * @param {Object} file - File object with name, type, size, url
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateFile(file) {
    const { name, type, size, url } = file;

    // Check required fields
    if (!name || !url) {
        return { valid: false, error: 'File name and URL are required' };
    }

    // Validate file size
    if (!size || size <= 0) {
        return { valid: false, error: 'Invalid file size' };
    }

    if (size > MAX_FILE_SIZE) {
        return { valid: false, error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }

    // Validate MIME type
    if (!type || !ALLOWED_MIME_TYPES.includes(type)) {
        return { valid: false, error: `File type '${type}' is not allowed. Allowed types: PDF, Word, Excel, PowerPoint, Text, CSV, Images (JPG/PNG/GIF/WEBP)` };
    }

    // Validate file extension (defense in depth)
    const fileNameLower = name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileNameLower.endsWith(ext));

    if (!hasValidExtension) {
        return { valid: false, error: `File extension not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}` };
    }

    // Validate Data URI format (basic check)
    if (!url.startsWith('data:')) {
        return { valid: false, error: 'Invalid file format - must be a data URI' };
    }

    // Check if MIME type in data URI matches declared type
    const dataUriMatch = url.match(/^data:([^;]+);/);
    if (dataUriMatch) {
        const dataUriMimeType = dataUriMatch[1];
        if (dataUriMimeType !== type) {
            return { valid: false, error: 'File type mismatch between declared type and data URI' };
        }
    }

    // Sanitize filename (prevent path traversal and command injection)
    const sanitizedName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (sanitizedName !== name) {
        // Return warning but allow (we'll use sanitized name)
        return { valid: true, error: null, sanitizedName };
    }

    return { valid: true, error: null };
}

/**
 * Validates attachment count for a task
 * @param {number} currentCount - Current number of attachments
 * @param {number} addingCount - Number of attachments being added
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateAttachmentCount(currentCount, addingCount = 1) {
    if (currentCount + addingCount > MAX_ATTACHMENTS_PER_TASK) {
        return {
            valid: false,
            error: `Maximum ${MAX_ATTACHMENTS_PER_TASK} attachments allowed per task. Current: ${currentCount}`
        };
    }
    return { valid: true, error: null };
}
