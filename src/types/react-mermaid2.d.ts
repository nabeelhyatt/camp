// types written by Claude. may be inaccurate. use at your own risk!!!

declare module "react-mermaid2" {
    import { Component } from "react";

    interface MermaidProps {
        chart: string;
        config?: unknown;
        className?: string;
        name?: string;
    }

    export default class Mermaid extends Component<MermaidProps> {}
}
