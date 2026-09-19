import { UpgradePage } from '@/components/payments/upgrade-page';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/app/_authed/upgrate')({
    component: RouteComponent,
    })

    function RouteComponent() {
        return <UpgradePage />;
    }