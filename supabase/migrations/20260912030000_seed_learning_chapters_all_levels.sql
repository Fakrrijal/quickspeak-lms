-- QuickSpeak Learning Progress
-- Seed curriculum chapters for Levels 1-4 exactly as supplied.
-- Material rows are intentionally not seeded.

insert into public.learning_chapters (ebook_id, chapter_number, title)
select
  v.ebook_id,
  v.chapter_number,
  v.title
from (
  values
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 1, 'Alphabet'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 2, 'Color'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 3, 'Number'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 4, 'Daily Activity'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 5, 'Family'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 6, 'Greeting'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 7, 'Daily Activity'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 8, 'Question Word'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 9, 'Introduction'),
    ('ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid, 10, 'TRY OUT'),

    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 1, 'Number'),
    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 2, 'Introduction'),
    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 3, 'Room and Place'),
    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 4, 'Simple Present Tense'),
    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 5, 'Animals'),
    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 6, 'Part of Body'),
    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 7, 'Toys'),
    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 8, 'Months'),
    ('973fa8f5-3691-4ea6-a837-afe69dbed1c0'::uuid, 9, 'TRY OUT'),

    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 1, 'Jobs'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 2, 'Things in Classroom'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 3, 'Food and Drink'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 4, 'Time'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 5, 'Clothes'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 6, 'Part of Body'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 7, 'Hobbies'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 8, 'Expression'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 9, 'SimplePresent Tense'),
    ('26103f73-3d50-4297-ad5d-eca74c216ef1'::uuid, 10, 'TRY OUT'),

    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 1, 'My Farm'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 2, 'Preposition'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 3, 'At The Market'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 4, 'What Do You Wear Today?'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 5, 'Traveling'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 6, 'Daily Activities'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 7, 'Close The Door, Please!'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 8, 'At The Park'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 9, 'My House'),
    ('5e4bcf95-cb41-4703-a5ce-76b5334b2a61'::uuid, 10, 'TRY OUT')
) as v(ebook_id, chapter_number, title)
on conflict (ebook_id, chapter_number)
do update
set title = excluded.title;
