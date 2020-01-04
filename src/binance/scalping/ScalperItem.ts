import { ScalperOptions } from "./GenericScalper";

export class ScalperItem {
    pair: string;
    symbol: string;
    options: ScalperOptions;
    enabled: boolean;
}