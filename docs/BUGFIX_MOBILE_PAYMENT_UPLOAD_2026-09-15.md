# Mobile Payment Proof Upload Fix — 2026-09-15

## Problem
Student payment proof uploads were reported as failing on mobile/HP devices.

## Fix
The payment upload service now:

- accepts JPEG/JPG/PNG images whose browser MIME type is empty or reports `image/jpg`;
- allows source photos up to 25 MiB;
- automatically resizes/compresses images to JPEG at or below the existing 5 MiB Storage limit before upload;
- keeps PDFs capped at 5 MiB;
- sends the normalized MIME type and final uploaded file size to Supabase;
- preserves the original filename in the payment proof record.

The Supabase `payment_proofs` bucket remains capped at 5 MiB, so the backend Storage security boundary is unchanged.
