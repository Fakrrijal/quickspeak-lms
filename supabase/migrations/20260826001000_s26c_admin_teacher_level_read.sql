-- S2.6C RLS Patch - Admin Teacher Level Read Access
-- QuickSpeak LMS Database Schema
-- Fix: Admins cannot read teacher_levels, causing empty dropdown in Create Teaching Group

-- Add SELECT policy for Admins to view teacher level eligibility
CREATE POLICY "Admins can view teacher level eligibility"
    ON public.teacher_levels
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
    );
