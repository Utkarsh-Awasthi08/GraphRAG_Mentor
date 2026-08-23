import neo4j from "neo4j-driver";

export function formatRecords(records) {

    return records.map(record => {

        const obj = {};

        for (const key of record.keys) {

            let value = record.get(key);

            if (neo4j.isInt(value)) {
                value = value.toNumber();
            }

            obj[key] = value;
        }

        return obj;
    });
}