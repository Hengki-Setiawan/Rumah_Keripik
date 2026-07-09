export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('Next.js server-side instrumentation registered successfully.');
  }
}
