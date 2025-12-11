import { StreamResponseParams } from "../Models";

export type ModelDisabled = "model_disabled";

export interface IProvider {
    streamResponse: (
        params: StreamResponseParams,
    ) => Promise<ModelDisabled | void>;
}
