import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get the token from environment
    const token = Deno.env.get('INTERNAL_FN_TOKEN');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'INTERNAL_FN_TOKEN not set in environment variables' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Execute ALTER DATABASE command
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER DATABASE postgres SET app.internal_fn_token TO '${token}'`
    });

    if (error) {
      console.error('Failed to set token:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to set database parameter',
          details: error.message,
          note: 'You may need to run this SQL manually in the backend: ALTER DATABASE postgres SET app.internal_fn_token TO \'your-token\''
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Database parameter app.internal_fn_token set successfully. Cron jobs can now authenticate.'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Setup error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
