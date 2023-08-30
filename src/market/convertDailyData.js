function ConvertData(data) {
    const blackListedKeys = "resourceType";
    for (const key in data) {
        if (Object.hasOwnProperty.call(data, key)) {
            const element = data[key];
            switch (typeof element) {
                case "number":
                    break;
                case "object":
                    data[key] = ConvertData(data[key])
                    break;
                default:
                    if (!blackListedKeys.includes(key)) delete data[key]
                    break;
            }
        }
    }
    return data
}

export default function ConvertDailyData(data) {
    let result = {}
    for (let shardName in ConvertData(data)) {
        result[shardName] = {}
        const shard = data[shardName]
        for (let resourceName in shard) {
            const resource = shard[resourceName]
            result[shardName][resource.resourceType] = resource
            delete result[shardName][resource.resourceType].resourceType
        }
    }
    return result
}