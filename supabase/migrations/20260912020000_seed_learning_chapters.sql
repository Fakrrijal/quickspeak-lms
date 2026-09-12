-- QuickSpeak Learning Progress
-- Seed only curriculum chapters explicitly verified from the supplied
-- QuickSpeak curriculum source. Material rows are intentionally not seeded.

insert into public.learning_chapters (ebook_id, chapter_number, title)
select
  e.id,
  v.chapter_number,
  v.title
from public.ebooks e
join (
  values
    (1, 'Alphabet'),
    (2, 'Color'),
    (3, 'Number'),
    (4, 'Daily Activity'),
    (5, 'Family'),
    (6, 'Greeting'),
    (7, 'Daily Activity'),
    (8, 'Question Word'),
    (9, 'Introduction')
) as v(chapter_number, title) on true
where e.id = 'ff76e34f-316c-4f8d-97b4-7a6632d221fe'::uuid
  and e.status = 'published'
on conflict (ebook_id, chapter_number)
do update
set title = excluded.title;
