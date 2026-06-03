exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const API_KEY  = process.env.MAILERLITE_API_KEY;
    const GROUP_ID = process.env.MAILERLITE_GROUP_ID;

    if (!API_KEY || !GROUP_ID) {
        console.error('Missing MAILERLITE_API_KEY or MAILERLITE_GROUP_ID environment variables');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    const { email, first_name, last_name, company } = body;

    if (!email || !first_name) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Email and first name are required' }) };
    }

    const fields = { name: first_name };
    if (last_name) fields.last_name = last_name;
    if (company)   fields.company   = company;

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
    };

    try {
        // Step 1: Create or update subscriber
        const subRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, fields })
        });

        const subData = await subRes.json();

        if (!subRes.ok && subRes.status !== 200 && subRes.status !== 201) {
            console.error('MailerLite subscriber error:', subData);
            return { statusCode: 502, body: JSON.stringify({ error: 'Could not create subscriber' }) };
        }

        const subscriberId = subData.data?.id;
        if (!subscriberId) {
            return { statusCode: 502, body: JSON.stringify({ error: 'No subscriber ID returned' }) };
        }

        // Step 2: Add to "Website Opt-in" group
        const groupRes = await fetch(
            `https://connect.mailerlite.com/api/subscribers/${subscriberId}/groups/${GROUP_ID}`,
            { method: 'POST', headers }
        );

        if (!groupRes.ok) {
            const groupData = await groupRes.json();
            console.error('MailerLite group error:', groupData);
            return { statusCode: 502, body: JSON.stringify({ error: 'Could not add to group' }) };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };

    } catch (err) {
        console.error('Unexpected error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
    }
};
