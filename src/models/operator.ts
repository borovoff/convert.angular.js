import {Nullable} from './nullable';
import {InnerOperator} from './inner-operator';

export interface Operator {
    code: Nullable<number>
    description: Nullable<string>
    operator: InnerOperator
    version: Nullable<number>
}
