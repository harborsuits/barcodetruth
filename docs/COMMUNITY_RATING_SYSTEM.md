# Community Rating System

## Overview

The Community Rating System allows users to rate both **brands** and **key people** (CEOs, founders, chairpersons) across multiple categories. This creates a comprehensive, community-driven accountability system.

## Rating Tables

### 1. Brand Ratings (`community_ratings`)

**Existing table** for rating brands/companies.

**Categories:**
- `labor` - Labor practices, worker treatment
- `environment` - Environmental impact and sustainability
- `politics` - Political donations and lobbying
- `social` - Social responsibility and community impact

**Schema:**
```sql
- id (UUID)
- user_id (UUID) - references auth.users
- brand_id (UUID) - references brands
- category (TEXT)
- score (SMALLINT 1-10)
- context_note (TEXT) - optional explanation
- evidence_url (TEXT) - optional supporting link
- weight (NUMERIC) - default 1.0
- created_at, updated_at
- UNIQUE(user_id, brand_id, category)
```

### 2. Person Ratings (`person_ratings`)

**New table** for rating key people (CEOs, founders, executives).

**Categories:**
- `leadership` - Leadership quality and vision
- `ethics` - Ethical behavior and integrity
- `transparency` - Communication and openness
- `social_impact` - Positive social contributions
- `environmental` - Environmental stewardship
- `labor_practices` - Treatment of workers and labor relations

**Schema:**
```sql
- id (UUID)
- user_id (UUID) - references auth.users
- person_id (UUID) - references company_people
- category (TEXT)
- score (SMALLINT 1-10)
- context_note (TEXT) - optional explanation
- evidence_url (TEXT) - optional supporting link
- weight (NUMERIC) - default 1.0
- created_at, updated_at
- UNIQUE(user_id, person_id, category)
```

## Admin Dashboard

Navigate to `/admin/community-ratings` to:

### View Statistics
- Total ratings (brands + people)
- Unique raters
- Entities rated
- Category breakdown with averages

### Monitor Ratings
- **Brand Ratings Tab**: View all brand ratings with:
  - Brand name and logo
  - Category and score
  - User context notes
  - Evidence links
  - Timestamp and user ID
  
- **Key People Ratings Tab**: View all person ratings with:
  - Person name and photo
  - Role and company
  - Category and score
  - User context notes
  - Evidence links
  - Timestamp and user ID

### Filter & Search
- Filter by category
- Search by name
- Real-time updates (30s refresh)

### Moderation
- Delete inappropriate ratings
- Confirmation dialog for safety
- Automatic refresh after moderation

## Security & RLS

### Users Can:
- ✅ Insert their own ratings
- ✅ Update their own ratings
- ✅ View their own ratings

### Admins Can:
- ✅ View all ratings
- ✅ Delete any rating (moderation)

### Users Cannot:
- ❌ View other users' ratings (privacy)
- ❌ Delete their own ratings (use update instead)
- ❌ Rate the same entity/category twice (enforced by UNIQUE constraint)

## Rating Guidelines for Users

### Good Rating Practices
1. **Be Specific**: Add context notes explaining your rating
2. **Provide Evidence**: Link to sources when possible
3. **Be Fair**: Base ratings on facts, not emotions
4. **Update When Appropriate**: Things change, update your ratings
5. **Use Full Scale**: Don't just rate 1 or 10, use the full 1-10 range

### Rating Scale
- **9-10**: Exceptional, industry-leading
- **7-8**: Good, above average
- **5-6**: Average, meets expectations
- **3-4**: Below average, concerning
- **1-2**: Very poor, serious issues

## Future Enhancements

### Potential Features
- **Weighted Averages**: Weight ratings by user reputation
- **Trust Tiers**: Track rating accuracy over time
- **Rating Trends**: Show how ratings change over time
- **Voting on Ratings**: Upvote/downvote for helpful ratings
- **Rating Contests**: Challenge ratings with counter-evidence
- **Shareholder Ratings**: Rate major shareholders and investors
- **Board Member Ratings**: Rate board of directors

### Analytics
- Average ratings per person/brand
- Rating trends over time
- Category-specific insights
- Comparison between brands
- CEO/founder reputation scores

## Implementation Notes

### Key People Source
- Person data comes from `company_people` table
- Populated via Wikidata enrichment (enrich-brand-wiki function)
- Includes CEOs (P169), Chairpersons (P488), Founders (P112)
- Links to parent companies via `company_ownership`

### Rating Weight System
- Default weight: 1.0
- Can be adjusted for trusted/verified users
- Future: Calculate based on:
  - Evidence quality
  - Rating accuracy history
  - User reputation score

### Performance Considerations
- Indexes on: `person_id`, `user_id`, `created_at`
- Unique constraint prevents duplicate ratings
- Efficient queries for aggregation

## API Usage

### Rate a Person
```typescript
const { data, error } = await supabase
  .from('person_ratings')
  .insert({
    person_id: 'uuid-of-person',
    category: 'leadership',
    score: 8,
    context_note: 'Strong vision and execution',
    evidence_url: 'https://example.com/article'
  });
```

### Update Your Rating
```typescript
const { data, error } = await supabase
  .from('person_ratings')
  .update({
    score: 7,
    context_note: 'Updated after recent events',
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId)
  .eq('person_id', personId)
  .eq('category', 'leadership');
```

### Get Person's Ratings
```typescript
const { data, error } = await supabase
  .from('person_ratings')
  .select(`
    *,
    company_people:person_id (
      person_name,
      role,
      image_url
    )
  `)
  .eq('person_id', personId);
```

### Get User's Ratings
```typescript
const { data, error } = await supabase
  .from('person_ratings')
  .select(`
    *,
    company_people:person_id (
      person_name,
      role,
      companies:company_id (name)
    )
  `)
  .eq('user_id', userId);
```

## Database Migrations

The person ratings table was created with migration `20251022051134_cc67c1d5-727f-448c-83d2-ac9fb6641b53.sql`

Includes:
- Table creation with proper constraints
- RLS policies for users and admins
- Indexes for performance
- Trigger for updated_at column
