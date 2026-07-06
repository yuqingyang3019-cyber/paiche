const { chinaDate } = require("./date");

const COLLECTION = "vehicle_entries";

function db() {
  return uniCloud.database();
}

function recordDate(day = chinaDate()) {
  return day.iso;
}

function toVehicle(item) {
  return {
    id: item._id,
    plate: item.plate,
    name: item.name,
    phone: item.phone,
    idCard: item.id_card || item.idCard,
  };
}

async function loadVehicles(userid, day = chinaDate()) {
  const res = await db()
    .collection(COLLECTION)
    .where({ userid, record_date: recordDate(day) })
    .orderBy("created_at", "asc")
    .get();
  return (res.data || []).map(toVehicle);
}

async function appendVehicles(userid, vehicles, day = chinaDate()) {
  const current = recordDate(day);
  const collection = db().collection(COLLECTION);
  const now = Date.now();
  for (const vehicle of vehicles) {
    await collection.add({
      userid,
      record_date: current,
      plate: vehicle.plate,
      name: vehicle.name,
      phone: vehicle.phone,
      id_card: vehicle.idCard,
      created_at: now,
    });
  }
  return loadVehicles(userid, day);
}

async function clearVehicles(userid, day = chinaDate()) {
  await db().collection(COLLECTION).where({ userid, record_date: recordDate(day) }).remove();
}

async function removeVehicle(userid, id, day = chinaDate()) {
  await db().collection(COLLECTION).where({ _id: id, userid, record_date: recordDate(day) }).remove();
  return loadVehicles(userid, day);
}

module.exports = {
  appendVehicles,
  clearVehicles,
  loadVehicles,
  removeVehicle,
};
