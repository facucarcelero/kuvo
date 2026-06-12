-- Datos públicos de muestra para desarrollo/demo.
-- NO ejecutar en producción. Usar solo en entornos locales o staging.
insert into public.profiles (id,role,full_name,username,city,bio,verified,active) values
('10000000-0000-0000-0000-000000000001','creator','Vale López','valelopez','Buenos Aires','Moda, belleza y lifestyle con contenido auténtico y orientado a conversión.',true,true),
('10000000-0000-0000-0000-000000000002','creator','Santi Ríos','santirios','Córdoba','Entrenamiento, hábitos y reseñas honestas para comunidades activas.',true,true),
('10000000-0000-0000-0000-000000000003','creator','Mai Morales','maimorales','Mendoza','Viajes y experiencias premium con estética editorial.',true,true),
('10000000-0000-0000-0000-000000000004','creator','Tomi Cáceres','tomicaceres','Rosario','Tecnología explicada de manera simple y entretenida.',true,true),
('10000000-0000-0000-0000-000000000005','creator','Luz Herrera','luzherrera','San Juan','Recomendaciones locales, planes familiares y gastronomía en Cuyo.',true,true),
('10000000-0000-0000-0000-000000000006','creator','Nico Paz','nicopaz','Buenos Aires','Humor cotidiano e integraciones naturales.',true,true),
('20000000-0000-0000-0000-000000000001','business','Brasa Norte','brasanorte','San Juan','Restaurante de cocina argentina.',true,true),
('20000000-0000-0000-0000-000000000002','business','Marea','marea','Mendoza','Marca de indumentaria urbana.',true,true),
('20000000-0000-0000-0000-000000000003','business','Punto App','puntoapp','Buenos Aires','Tecnología para comercios.',true,true),
('20000000-0000-0000-0000-000000000004','business','Aura Club','auraclub','Córdoba','Bienestar y entrenamiento.',true,true)
on conflict (id) do nothing;

insert into public.creator_profiles (id,profile_id,categories,followers,engagement,starting_price,score,availability,portfolio) values
('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',array['Moda','Belleza','Lifestyle'],128000,6.3,80000,94,true,'[{"title":"Reel de lanzamiento"},{"title":"Historia con enlace"},{"title":"Contenido UGC"}]'),
('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',array['Fitness','Deportes','Bienestar'],95000,7.1,70000,92,true,'[{"title":"Rutina patrocinada"},{"title":"Review de producto"}]'),
('11000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003',array['Viajes','Lifestyle','Gastronomía'],200000,5.8,120000,96,true,'[{"title":"Cobertura de hotel"},{"title":"Guía gastronómica"}]'),
('11000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004',array['Tecnología','Gaming','Apps'],75000,6.2,80000,90,true,'[{"title":"Demo de app"},{"title":"Unboxing"}]'),
('11000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005',array['Gastronomía','Familia','Eventos'],42000,9.4,52000,91,true,'[{"title":"Visita al local"},{"title":"Historia con reserva"}]'),
('11000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000006',array['Humor','Entretenimiento','Lifestyle'],310000,8.1,175000,95,true,'[{"title":"Sketch integrado"},{"title":"Evento en vivo"}]')
on conflict (id) do nothing;

insert into public.business_profiles (id,profile_id,business_name,industry,location,verified) values
('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Brasa Norte','Gastronomía','San Juan',true),
('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Marea','Moda','Mendoza',true),
('21000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Punto App','Tecnología','Argentina',true),
('21000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004','Aura Club','Fitness','Córdoba',true)
on conflict (id) do nothing;

insert into public.campaigns (id,business_id,title,description,category,city,budget_min,budget_max,deliverables,status,deadline) values
('30000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','Noche parrillera','Buscamos creadores locales para mostrar la experiencia completa del restaurante y generar reservas.','Gastronomía','San Juan',180000,260000,array['1 reel','3 historias','CTA a reservas'],'open','2026-07-01'),
('30000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','Colección urbana','Contenido UGC y reels para el lanzamiento de temporada, con derecho de uso por 60 días.','Moda','Mendoza',130000,210000,array['2 videos UGC','5 fotos'],'open','2026-07-10'),
('30000000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000003','Lanzamiento de aplicación','Creadores de tecnología y emprendimiento para explicar una aplicación de forma simple.','Tecnología','Argentina',220000,350000,array['1 demo','1 reel','2 historias'],'open','2026-07-15'),
('30000000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000004','Experiencia wellness','Jornada presencial con historias, un reel y reseña de experiencia.','Fitness','Córdoba',110000,170000,array['1 reel','4 historias'],'open','2026-06-28')
on conflict (id) do nothing;
