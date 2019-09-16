import { parseColor } from './util';

export class Bucket {
    Id: number;
    Name: string;
    Order: number;
    Color: string;
    data: Array<any>;

    dynamic?: boolean;

    static getIntersection(bucket1: Bucket, bucket2: Bucket, callback: (intersection: Bucket, bucket1Without2: Bucket, bucket2Without: Bucket) => void) {
        let newBucket1: Bucket = {
            Id: bucket1.Id,
            Name: bucket1.Name,
            Order: bucket1.Order,
            Color: bucket1.Color,
            data: []
        };
        let newBucket2: Bucket = {
            Id: bucket2.Id,
            Name: bucket2.Name,
            Order: bucket2.Order,
            Color: bucket2.Color,
            data: []
        };

        let bucket1ParsedColor = parseColor(bucket1.Color);
        let bucket2ParsedColor = parseColor(bucket2.Color);
        let newBucketColor;

        if (bucket1ParsedColor && bucket2ParsedColor) {
            newBucketColor = [
                (parseInt(bucket1ParsedColor[0]) + parseInt(bucket2ParsedColor[0])) / 2,
                (parseInt(bucket1ParsedColor[1]) + parseInt(bucket2ParsedColor[1])) / 2,
                (parseInt(bucket1ParsedColor[2]) + parseInt(bucket2ParsedColor[2])) / 2,
            ]
            newBucketColor = `rgb(${newBucketColor[0]},${newBucketColor[1]},${newBucketColor[2]})`;
        } else {
            newBucketColor = null;
        }

        let intersection: Bucket = {
            Id: null,
            Name: bucket1.Name + " ∩ " + bucket2.Name,
            Order: null,
            Color: newBucketColor,
            data: []
        };
        let index1 = 0;
        let index2 = 0;
        while (index1 < bucket1.data.length || index2 < bucket2.data.length) {
            if (index1 >= bucket1.data.length) {
                newBucket2.data.push(bucket2.data[index2]);
                index2++;
                continue;
            }

            if (index2 >= bucket2.data.length) {
                newBucket1.data.push(bucket1.data[index1]);
                index1++;
                continue;
            }

            if (bucket1.data[index1].Id == bucket2.data[index2].Id) {
                intersection.data.push(bucket1.data[index1]);
                index1++;
                index2++;
            } else if (bucket1.data[index1].Id < bucket2.data[index2].Id) {
                newBucket1.data.push(bucket1.data[index1]);
                index1++;
            } else if (bucket1.data[index1].Id > bucket2.data[index2].Id) {
                newBucket2.data.push(bucket2.data[index2]);
                index2++;
            }
        }

        callback(intersection, newBucket1, newBucket2);

        return;
    }
}