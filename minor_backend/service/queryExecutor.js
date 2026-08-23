import driver from "../neo4.js";

const MAX_RESULT_LIMIT = 25;

/**
 * Enforce a LIMIT clause on Cypher queries to prevent massive result sets.
 * Skip if query already has a LIMIT or uses aggregation (COUNT, SUM, AVG, COLLECT).
 */
function enforceCypherLimit(query) {
    const upperQuery = query.toUpperCase().trim();
    
    // Skip if already has LIMIT
    if (upperQuery.includes("LIMIT ")) return query;
    
    // Skip if it's an aggregate query (these naturally return few rows)
    const aggregateKeywords = ["COUNT(", "SUM(", "AVG(", "COLLECT(", "MIN(", "MAX("];
    if (aggregateKeywords.some(kw => upperQuery.includes(kw))) return query;
    
    // Append LIMIT
    console.log(`📊 Auto-appending LIMIT ${MAX_RESULT_LIMIT} to query`);
    return `${query.trim()}\nLIMIT ${MAX_RESULT_LIMIT}`;
}

export async function executeQuery(
    query,
    params
) {

    const session =
        driver.session();

    try {
        const limitedQuery = enforceCypherLimit(query);
        console.log("Executing Query:");
        console.log(limitedQuery);
        console.log(params);
        const result =
            await session.run(
                limitedQuery,
                params
            );

        return result.records;

    } catch (err) {        
        console.error(
            "Query Execution Error:",
            err
        );

        throw err;

    } finally {
        await session.close();
    }
}

export async function executeReadQuery(
    query,
    params
) {

    const session =
        driver.session();

    try {
        const limitedQuery = enforceCypherLimit(query);
        console.log("Executing Read Query:");
        console.log(limitedQuery);
        console.log(params);
        
        // Execute inside a read transaction. This blocks any write operations (CREATE, MERGE, SET, DELETE)
        const result = await session.executeRead(tx => tx.run(limitedQuery, params));

        return result.records;

    } catch (err) {        
        console.error(
            "Read Query Execution Error:",
            err
        );

        throw err;

    } finally {
        await session.close();
    }
}