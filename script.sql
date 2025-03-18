CREATE TABLE "public".sensores (
	id serial4 NOT NULL,
	sensor_id varchar(50) NOT NULL,
	valor numeric(10, 2) NOT NULL,
	fecha_hora timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT sensores_pkey PRIMARY KEY (id)
);