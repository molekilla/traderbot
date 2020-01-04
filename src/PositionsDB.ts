import { Db, Server, MongoClient } from 'mongodb';
import { Position } from './traderbot/models/Position';

export class PositionsDB {
    db!: Db;
    constructor() {
    }

    public async init() {
        const mongo = MongoClient;
        const client = await mongo.connect('mongodb://127.0.0.1:27017', {
            useNewUrlParser: true
        });
        this.db = client.db('mmmbot');        
    }

    public async update(position: Position) {
        const coll = this.db.collection('positions');
        
        return await coll.updateOne({ _id: position._id }, { $set: position });        
    }

    public async add(position: Position) {
        const coll = this.db.collection('positions');
        // ts-ignore
        position._id = undefined;

        const doc = await coll.insertOne(position);

        return doc;
    }


    public async remove(id: string) {
        const coll = this.db.collection('positions');

        const doc = await coll.deleteOne({ id });

        return doc;
    }
    public async getCurrentPositions(): Promise<Position[]> {
        const coll = this.db.collection('positions');

        const positions = await coll.find({ sold: false }).toArray();

        return positions;
    }

    public async getPastPositions(): Promise<Position[]> {
        const coll = this.db.collection('positions');

        const positions = await coll.find({ sold: true }).toArray();

        return positions;
    }

    public async hasPositions() {
        const coll = this.db.collection('positions');
        const count = await coll.estimatedDocumentCount();
        return count > 0;
    }

    public async hasActivePositions() {
        const coll = this.db.collection('positions');
        const positions = await coll.find({ sold: false }).toArray();
        return positions.length > 0;
    }
}