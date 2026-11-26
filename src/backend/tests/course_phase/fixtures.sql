insert into courses(code,name,activation_mode,active_terms)
values ('WM-PHASE','Local phase fixture','force_active',array['Winter','Spring','Fall']),
       ('WM-OTHER','Other course','force_active',array['Winter','Spring','Fall']);
insert into users(email,role,course_fk,active)
select role || '-' || code || '@uwaterloo.ca', role, course_id, enabled
from (values ('admin','WM-PHASE',true),('instructor','WM-PHASE',true),('instructor','WM-OTHER',true),
  ('student','WM-PHASE',true),('mentor','WM-PHASE',true)) as roles(role,code,enabled)
join courses using (code);
insert into users(email,role,course_fk,active) select 'inactive@uwaterloo.ca','instructor',course_id,false
from courses where code='WM-PHASE';
