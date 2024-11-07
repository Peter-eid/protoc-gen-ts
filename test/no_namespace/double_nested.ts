/**
 * Generated by the protoc-gen-ts.  DO NOT EDIT!
 * compiler version: 3.19.1
 * source: test/_/no_namespace/double_nested.proto
 * git: https://github.com/thesayyn/protoc-gen-ts */
import * as pb_1 from "google-protobuf";
export class MessageFields extends pb_1.Message {
    #one_of_decls: number[][] = [];
    constructor(data?: any[] | {
        field?: string[];
    }) {
        super();
        pb_1.Message.initialize(this, Array.isArray(data) ? data : [], 0, -1, [1], this.#one_of_decls);
        if (!Array.isArray(data) && typeof data == "object") {
            if ("field" in data && data.field != undefined) {
                this.field = data.field;
            }
        }
    }
    get field() {
        return pb_1.Message.getFieldWithDefault(this, 1, []) as string[];
    }
    set field(value: string[]) {
        pb_1.Message.setField(this, 1, value);
    }
    static fromObject(data: {
        field?: string[];
    }): MessageFields {
        const message = new MessageFields({});
        if (data.field != null) {
            message.field = data.field;
        }
        return message;
    }
    toObject() {
        const data: {
            field?: string[];
        } = {};
        if (this.field != null) {
            data.field = this.field;
        }
        return data;
    }
    serialize(): Uint8Array;
    serialize(w: pb_1.BinaryWriter): void;
    serialize(w?: pb_1.BinaryWriter): Uint8Array | void {
        const writer = w || new pb_1.BinaryWriter();
        if (this.field.length)
            writer.writeRepeatedString(1, this.field);
        if (!w)
            return writer.getResultBuffer();
    }
    static deserialize(bytes: Uint8Array | pb_1.BinaryReader): MessageFields {
        const reader = bytes instanceof pb_1.BinaryReader ? bytes : new pb_1.BinaryReader(bytes), message = new MessageFields();
        while (reader.nextField()) {
            if (reader.isEndGroup())
                break;
            switch (reader.getFieldNumber()) {
                case 1:
                    pb_1.Message.addToRepeatedField(message, 1, reader.readString());
                    break;
                default: reader.skipField();
            }
        }
        return message;
    }
    serializeBinary(): Uint8Array {
        return this.serialize();
    }
    static deserializeBinary(bytes: Uint8Array): MessageFields {
        return MessageFields.deserialize(bytes);
    }
}