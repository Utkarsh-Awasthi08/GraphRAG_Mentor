import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{
    host: 'localhost',
    port: '8109',
    protocol: 'http'
  }],
  apiKey: 'minor_project_key',
  connectionTimeoutSeconds: 2
});

const COLLECTION_NAME = 'chat_history';

export async function initTypesense() {
  try {
    const exists = await client.collections(COLLECTION_NAME).retrieve().catch(() => null);
    if (!exists) {
      await client.collections().create({
        name: COLLECTION_NAME,
        fields: [
          { name: 'id', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'query', type: 'string' },
          { name: 'mode', type: 'string' },
          { name: 'timestamp', type: 'string', sort: true },
        ]
      });
      console.log(`Created Typesense collection: ${COLLECTION_NAME}`);
    } else {
      console.log(`Typesense collection ${COLLECTION_NAME} exists.`);
    }
  } catch (err) {
    console.error("Failed to init Typesense:", err);
  }
}

export async function indexChat(chatDocument) {
  try {
    await client.collections(COLLECTION_NAME).documents().upsert(chatDocument);
  } catch (err) {
    console.error("Failed to index chat in Typesense:", err);
  }
}

export async function searchChats(userId, q, page = 1, perPage = 10) {
  try {
    const searchParams = {
      q,
      query_by: 'query',
      filter_by: `userId:=${userId}`,
      sort_by: 'timestamp:desc',
      page,
      per_page: perPage
    };
    
    const result = await client.collections(COLLECTION_NAME).documents().search(searchParams);
    return result;
  } catch (err) {
    console.error("Error searching Typesense:", err);
    return { hits: [], found: 0, page: 1, out_of: 0 };
  }
}
