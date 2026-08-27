export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.VERCEL === '1') {
    try {
      const mod = await import('@vercel/otel');
      const { registerOTel, OTLPHttpProtoTraceExporter } = mod;
      registerOTel({
        serviceName: 'rumah-kripik-web',
        attributes: {
          'deployment.environment': process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
        },
        traceExporter: new OTLPHttpProtoTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://api.vercel.com/v1/otel',
          headers: {
            Authorization: `Bearer ${process.env.OTEL_EXPORTER_OTLP_HEADERS || ''}`,
          },
        }),
      });
    } catch {
      console.log('OpenTelemetry not available (missing @vercel/otel).');
    }
  }
}
