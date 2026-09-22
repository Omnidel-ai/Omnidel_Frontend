import { useState } from "react";
import {
  Button,
  EmptyState,
  Skeleton,
  SkeletonCard,
  SkeletonRows,
  SkeletonText,
  Table,
  type Column,
} from "../components";
import { Case, Section } from "./Case";

interface Row {
  id: string;
  name: string;
  city: string;
  stops: number;
}

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Name", width: "minmax(160px, 2fr)" },
  { key: "city", header: "City", width: "140px" },
  { key: "stops", header: "Stops", width: "90px", align: "right" },
];

/**
 * Empty states and skeletons — the two halves of "there is nothing to show
 * yet", which are different situations and look different on purpose.
 */
export function StatesSection() {
  const [loading, setLoading] = useState(false);

  return (
    <Section id="states" title="Empty states & skeletons">
      <Case label="Empty state — three variants, three different actions" stack>
        <div className="pg-grid-2" style={{ width: "100%" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", minHeight: 240, display: "flex" }}>
            <EmptyState
              variant="empty"
              title="No trade types yet"
              description="Trade types classify a kaarigar's work — carpentry, plumbing, wiring."
              action={<Button size="sm">Add the first trade type</Button>}
            />
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", minHeight: 240, display: "flex" }}>
            <EmptyState
              variant="no-results"
              title="No lanes match “barasat overnight”"
              description="Check the spelling, or clear the search to see all 43 lanes."
              action={
                <Button variant="secondary" size="sm">
                  Clear search
                </Button>
              }
            />
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", minHeight: 240, display: "flex" }}>
            <EmptyState
              variant="error"
              title="Couldn’t load locations"
              description="The request failed. Nothing was changed."
              action={<Button size="sm">Try again</Button>}
              secondaryAction={
                <Button variant="ghost" size="sm">
                  Report
                </Button>
              }
            />
          </div>
        </div>
      </Case>

      <Case label="Sizes — inline (in a card body) · card (own frame) · page" stack>
        <EmptyState
          size="card"
          variant="empty"
          title="Card size draws its own frame"
          description="For a panel that has nothing in it yet."
        />
      </Case>

      <Case label="Inside a table — empty vs no-results" stack>
        <div className="pg-grid-2" style={{ width: "100%" }}>
          <div>
            <div className="pg-case__label">No rows at all</div>
            <Table
              columns={COLUMNS}
              data={[]}
              minHeight={240}
              minWidth={460}
              emptyMessage="No locations yet"
              emptyHint="Add one and it shows up here."
              emptyAction={<Button size="sm">Add location</Button>}
            />
          </div>
          <div>
            <div className="pg-case__label">Filter matched nothing</div>
            <Table
              columns={COLUMNS}
              data={[]}
              minHeight={240}
              minWidth={460}
              emptyVariant="no-results"
              emptyMessage="No locations match “bagnan”"
              emptyHint="12 locations are hidden by the current filter."
              emptyAction={
                <Button variant="secondary" size="sm">
                  Clear filters
                </Button>
              }
            />
          </div>
        </div>
      </Case>

      <Case label="Skeletons — line, text block, card, table rows" stack>
        <div className="pg-grid-2" style={{ width: "100%" }}>
          <div className="pg-card">
            <div className="pg-case__label">Lines & shapes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton width="60%" />
              <Skeleton width="85%" />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Skeleton shape="circle" width={32} />
                <Skeleton width="50%" height={12} />
              </div>
              <Skeleton shape="block" height={56} />
            </div>
          </div>
          <div className="pg-card">
            <div className="pg-case__label">Text block</div>
            <SkeletonText lines={4} />
          </div>
          <SkeletonCard avatar lines={2} media={64} />
          <div className="pg-card">
            <div className="pg-case__label">Table rows, on the real grid</div>
            <div style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
              <SkeletonRows rows={4} columns={3} gridTemplateColumns="2fr 1fr 80px" />
            </div>
          </div>
        </div>
      </Case>

      <Case label="Loading → loaded, in a real table">
        <Button
          variant="secondary"
          onClick={() => {
            setLoading(true);
            window.setTimeout(() => setLoading(false), 1600);
          }}
        >
          {loading ? "Loading…" : "Reload the table"}
        </Button>
      </Case>
      <Table
        columns={COLUMNS}
        data={
          loading
            ? []
            : [
                { id: "1", name: "Newtown Warehouse", city: "Kolkata", stops: 14 },
                { id: "2", name: "Salt Lake Branch", city: "Kolkata", stops: 9 },
                { id: "3", name: "Howrah Pickup", city: "Howrah", stops: 6 },
              ]
        }
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={3}
        minHeight={220}
        minWidth={460}
      />
    </Section>
  );
}
