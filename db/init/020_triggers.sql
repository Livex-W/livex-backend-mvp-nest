CREATE OR REPLACE FUNCTION set_generic_hex_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code text;
    collision boolean;
    -- Definimos la longitud del código (3 bytes = 6 caracteres)
    byte_length integer := 3; 
BEGIN
    -- Si ya trae código, no hacemos nada
    IF NEW.code IS NOT NULL THEN
        RETURN NEW;
    END IF;

    LOOP
        -- Generar código (ej: 3 bytes = 6 caracteres HEX)
        new_code := upper(encode(gen_random_bytes(byte_length), 'hex'));

        -- SQL DINÁMICO:
        -- %I se reemplaza por el nombre de la tabla que disparó el trigger (TG_TABLE_NAME)
        -- Esto busca si 'new_code' existe en la tabla actual
        EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE code = $1)', TG_TABLE_NAME)
        INTO collision
        USING new_code;

        -- Si no existe, lo asignamos y salimos
        IF NOT collision THEN
            NEW.code := new_code;
            EXIT;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_experience_code
BEFORE INSERT ON experiences
FOR EACH ROW
EXECUTE FUNCTION set_generic_hex_code();

CREATE TRIGGER trigger_generate_booking_code
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_generic_hex_code();
