insert into public.transactions
(contact_id, client_name, address, closed_date, source_of_business, deal_type, sold_price, commission_pct, gci, broker_share, admin_fee, agent_share)
values
((select id from public.contacts where lower(display_name) = lower('Walter George') limit 1), 'Walter George', '2233 Woodside #4 Sacramento, Ca 95825', '2025-01-13', 'Previous Client', 'seller', 273000, 2, 5460, 1391.15, 500, 3568.85),
((select id from public.contacts where lower(display_name) = lower('Marisa Wendling') limit 1), 'Marisa Wendling', '2461 Castro Way Sacramento, Ca 95818', '2025-02-11', 'SOI', 'buyer', 878900, 2.5, 21972.5, 3958.67, 500, 17371.83),
((select id from public.contacts where lower(display_name) = lower('David & Vicky Brutski') limit 1), 'David & Vicky Brutski', '2405 Forest Oaks Ct Lincoln, Ca 95648', '2025-02-14', 'SOI', 'seller', 630000, 1.5, 9450, 1515.13, 500, 7434.87),
((select id from public.contacts where lower(display_name) = lower('Ian & Diana Clark') limit 1), 'Ian & Diana Clark', '2097 Gold Rush Gold River, Ca', '2025-03-14', 'SOI', 'seller', 515000, 2.5, 12875, 1903, 500, 9772),
((select id from public.contacts where lower(display_name) = lower('Garrett Nick & Angela Short') limit 1), 'Garrett Nick & Angela Short', '5821 Merlindale, Citrus Heights, ca 95610', '2025-04-03', 'SOI', 'buyer', 600000, 2.5, 15000, 2319.88, 500, 12180.12),
((select id from public.contacts where lower(display_name) = lower('Janice Dittman') limit 1), 'Janice Dittman', '121 Hartnell Place, Sacramento CA 95825', '2025-04-16', 'SOI', 'seller', 567000, 2, 11340, 1789.18, 500, 9050.82),
((select id from public.contacts where lower(display_name) = lower('Darren E. Tierney') limit 1), 'Darren E. Tierney', '4730 New York Fair Oaks, Ca 95628', '2025-04-23', 'Previous Client', 'seller', 447000, 2.5, 11175, 1765.25, 500, 8909.75);
