-- Crear tabla para logs de emails
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    template_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'retrying', 'pending')),
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON email_logs(template_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- Comentarios
COMMENT ON TABLE email_logs IS 'Registro de envíos de email y su estado';
COMMENT ON COLUMN email_logs.job_id IS 'ID único del job de notificación';
COMMENT ON COLUMN email_logs.recipient IS 'Email del destinatario';
COMMENT ON COLUMN email_logs.template_type IS 'Tipo de plantilla de email utilizada';
COMMENT ON COLUMN email_logs.status IS 'Estado del envío: sent, failed, retrying, pending';
COMMENT ON COLUMN email_logs.attempts IS 'Número de intentos de envío';
COMMENT ON COLUMN email_logs.error_message IS 'Mensaje de error si el envío falló';
