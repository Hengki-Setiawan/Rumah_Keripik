export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const mod = await import('@vercel/otel');
      const { registerOTel } = mod;
      const { OTLPHttpProtoTraceExporter } = mod;
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
      console.log('Next.js server-side instrumentation registered.');
    }
  }
}
