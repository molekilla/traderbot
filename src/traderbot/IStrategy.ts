import { Position } from './Position';
import { TechnicalIndicator } from '../indicators/TechnicalIndicator';

export interface IStrategy {
    has(pair: string): Boolean;
    getTechnicalIndicatorConfig(): {
        indicators: TechnicalIndicator,
        period: string,
        periods: number[],
        keys: string[],
    };
    executePair(pair: string, pos: Position): Promise<any>;
}